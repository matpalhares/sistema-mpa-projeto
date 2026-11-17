# MPA: exportar marcenaria (SketchUp 2017 ou mais novo)
# Gera um arquivo leve (JSON, versao mpa-marcenaria-1) com as pecas do movel para o Sistema MPA Projeto.
# Como usar: Janela > Console Ruby > load 'C:/caminho/MPA_exportar_marcenaria.rb'
# Depois: selecione o movel (ou nada, para o modelo todo) e use Extensoes > MPA: exportar marcenaria.
# So grupos e componentes que tem faces dentro deles viram pecas. Medidas em milimetros.
require 'json'

module MPA
  module ExportarMarcenaria
    MM = 25.4

    def self.nome_de(e)
      n = e.name.to_s
      n = e.definition.name.to_s if n.empty?
      n.empty? ? 'Peca' : n
    end

    def self.atributos(e)
      saida = {}
      [e, e.definition].each do |dono|
        dicts = dono.attribute_dictionaries
        next unless dicts
        dicts.each do |d|
          next if d.name =~ /\A(GSU_|SU_)/
          d.each_pair do |k, v|
            saida["#{d.name}.#{k}"] = v if v.is_a?(String) || v.is_a?(Numeric) || v == true || v == false
          end
        end
      end
      saida
    end

    def self.peca(e, t, caminho, oculto, mat_pai, cores)
      faces = e.definition.entities.grep(Sketchup::Face)
      return nil if faces.empty?
      # caixa no espaco da propria peca (medidas reais, com a escala aplicada)
      lmin = [1e30, 1e30, 1e30]; lmax = [-1e30, -1e30, -1e30]
      gmin = [1e30, 1e30, 1e30]; gmax = [-1e30, -1e30, -1e30]
      volume = 0.0
      areas = Hash.new(0.0)
      faces.each do |f|
        f.vertices.each do |v|
          p = v.position; g = p.transform(t)
          [p.x, p.y, p.z].each_with_index { |c, i| lmin[i] = c.to_f if c < lmin[i]; lmax[i] = c.to_f if c > lmax[i] }
          [g.x, g.y, g.z].each_with_index { |c, i| gmin[i] = c.to_f if c < gmin[i]; gmax[i] = c.to_f if c > gmax[i] }
        end
        m = f.material || e.material || mat_pai
        areas[m] += f.area
        mesh = f.mesh(0)
        mesh.polygons.each do |pol|
          a, b, c = pol.map { |i| mesh.point_at(i.abs).transform(t) }
          volume += (a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x)) / 6.0
        end
      end
      m = t.to_a
      escala = [Math.sqrt(m[0]**2 + m[1]**2 + m[2]**2), Math.sqrt(m[4]**2 + m[5]**2 + m[6]**2), Math.sqrt(m[8]**2 + m[9]**2 + m[10]**2)]
      dims = (0..2).map { |i| ((lmax[i] - lmin[i]) * escala[i] * MM).round(1) }
      caixa = dims[0] * dims[1] * dims[2]
      material = areas.max_by { |_, a| a }
      material = material ? material[0] : nil
      cores[material.display_name] = material.color.to_a if material
      {
        'caminho' => caminho, 'nome' => nome_de(e), 'def' => e.definition.name.to_s,
        'tipo' => e.is_a?(Sketchup::Group) ? 'grupo' : 'componente', 'oculto' => oculto, 'tag' => e.layer ? e.layer.name : '',
        'material' => material ? material.display_name : nil,
        'dims_mm' => dims.sort.reverse,
        'bbox_mm' => [gmin.map { |c| (c * MM).round(1) }, gmax.map { |c| (c * MM).round(1) }],
        'caixa_ratio' => caixa > 0 ? ((volume.abs * MM**3) / caixa).round(3) : 0,
        'attrs' => atributos(e)
      }
    end

    def self.percorrer(entidades, t, caminho, oculto, mat_pai, pecas, cores)
      entidades.each do |e|
        next unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
        tt = t * e.transformation
        oc = oculto || e.hidden? || (e.layer && !e.layer.visible?)
        mat = e.material || mat_pai
        p = peca(e, tt, caminho, oc, mat, cores)
        pecas << p if p
        percorrer(e.definition.entities, tt, caminho + [nome_de(e)], oc, mat, pecas, cores)
      end
    end

    def self.exportar
      modelo = Sketchup.active_model
      sel = modelo.selection.to_a
      entidades = sel.empty? ? modelo.entities.to_a : sel
      pecas = []; cores = {}
      percorrer(entidades, Geom::Transformation.new, [], false, nil, pecas, cores)
      if pecas.empty?
        UI.messagebox('Nenhuma peca encontrada. Cada peca precisa ser um grupo ou componente.')
        return
      end
      base = File.basename(modelo.path.to_s, '.skp')
      base = 'modelo' if base.empty?
      caminho = UI.savepanel('Salvar as pecas para o Sistema MPA', File.dirname(modelo.path.to_s), "#{base}_marcenaria.json")
      return unless caminho
      caminho += '.json' unless caminho =~ /\.json\z/i
      File.open(caminho, 'w:UTF-8') { |f| f.write(JSON.generate('versao' => 'mpa-marcenaria-1', 'unidade' => 'mm', 'cores' => cores, 'pecas' => pecas)) }
      UI.messagebox("#{pecas.length} pecas exportadas.\nAgora envie este arquivo no Sistema MPA Projeto:\n#{caminho}")
    end

    unless file_loaded?(__FILE__)
      UI.menu('Extensions').add_item('MPA: exportar marcenaria') { MPA::ExportarMarcenaria.exportar }
      file_loaded(__FILE__)
    end
  end
end
