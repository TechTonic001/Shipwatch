UPDATE deployments AS d
   SET is_production = lower(btrim(d.environment)) =
                       lower(btrim(r.production_environment))
  FROM repositories AS r
 WHERE r.id = d.repo_id
   AND d.is_production IS DISTINCT FROM
       (lower(btrim(d.environment)) = lower(btrim(r.production_environment)));
